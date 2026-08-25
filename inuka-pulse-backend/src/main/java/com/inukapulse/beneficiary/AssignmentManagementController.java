package com.inukapulse.beneficiary;

import com.inukapulse.user.AppUserEntity;
import com.inukapulse.user.AppUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Assignment management API — Admin assigns Case Managers to cohorts.
 *
 * GET    /api/admin/assignments              → all assignments with user info
 * GET    /api/admin/assignments/case-managers → all Case Manager users
 * POST   /api/admin/assignments              → assign a Case Manager to a cohort
 * DELETE /api/admin/assignments              → remove an assignment
 *
 * All endpoints require ADMIN role.
 */
@RestController
@RequestMapping("/api/admin/assignments")
@RequiredArgsConstructor
@Slf4j
public class AssignmentManagementController {

    private final OfficerCohortAssignmentRepository assignmentRepository;
    private final AppUserRepository                  userRepository;
    private final BeneficiaryPredictionRepository    predictionRepository;

    // ── GET all assignments ───────────────────────────────────────────────────

    /**
     * GET /api/admin/assignments
     *
     * Returns all assignments enriched with Case Manager name + email.
     *
     * Response:
     * [
     *   { "id": 1, "userId": 5, "caseManagerName": "Jane Doe", "caseManagerEmail": "...",
     *     "cohortId": "COHORT-SC-001", "assignedAt": "..." },
     *   ...
     * ]
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listAssignments() {
        List<OfficerCohortAssignmentEntity> all = assignmentRepository.findAll();

        // Pre-fetch all user IDs in one query
        Set<Long> userIds = all.stream()
                .map(OfficerCohortAssignmentEntity::getUserId)
                .collect(Collectors.toSet());
        Map<Long, AppUserEntity> usersById = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(AppUserEntity::getId, u -> u));

        List<Map<String, Object>> result = all.stream()
                .sorted(Comparator.comparing(OfficerCohortAssignmentEntity::getCohortId))
                .map(a -> {
                    AppUserEntity user = usersById.get(a.getUserId());
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id",               a.getId());
                    row.put("userId",            a.getUserId());
                    row.put("caseManagerName",   user != null ? user.getName()  : "Unknown");
                    row.put("caseManagerEmail",  user != null ? user.getEmail() : "unknown");
                    row.put("cohortId",          a.getCohortId());
                    row.put("assignedAt",        a.getAssignedAt() != null ? a.getAssignedAt().toString() : null);
                    return row;
                })
                .toList();

        return ResponseEntity.ok(result);
    }

    // ── GET Case Manager users ────────────────────────────────────────────────

    /**
     * GET /api/admin/assignments/case-managers
     *
     * Returns all users with the Case Manager role so the admin UI can
     * populate the "assign to" dropdown.
     *
     * Response:
     * [ { "id": 5, "name": "Jane Doe", "email": "jane@inuka.org" }, ... ]
     */
    @GetMapping("/case-managers")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listCaseManagers() {
        List<Map<String, Object>> result = userRepository.findAll().stream()
                .filter(u -> u.getRole() != null
                        && "Case Manager".equalsIgnoreCase(u.getRole().getName()))
                .map(u -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id",    u.getId());
                    row.put("name",  u.getName());
                    row.put("email", u.getEmail());
                    return row;
                })
                .toList();
        return ResponseEntity.ok(result);
    }

    // ── GET available cohorts ─────────────────────────────────────────────────

    /**
     * GET /api/admin/assignments/cohorts
     *
     * Returns all cohort IDs that have prediction data, so the admin UI
     * can populate the "assign cohort" dropdown.
     */
    @GetMapping("/cohorts")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<List<String>> listCohorts() {
        // Derive cohort list from the prediction data
        List<String> cohorts = predictionRepository.findAll().stream()
                .map(BeneficiaryPredictionEntity::getCohortId)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
        return ResponseEntity.ok(cohorts);
    }

    // ── POST create assignment ────────────────────────────────────────────────

    /**
     * POST /api/admin/assignments
     *
     * Body: { "userId": 5, "cohortId": "COHORT-SC-001" }
     *
     * Idempotent — if the assignment already exists, returns the existing row.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN')")
    @Transactional
    public ResponseEntity<Map<String, Object>> createAssignment(
            @RequestBody CreateAssignmentRequest req) {

        if (req.getUserId() == null || req.getCohortId() == null || req.getCohortId().isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        // Idempotency check
        if (assignmentRepository.existsByUserIdAndCohortId(req.getUserId(), req.getCohortId())) {
            log.info("Assignment already exists: Case Manager {} → cohort {}", req.getUserId(), req.getCohortId());
            // Return the existing row
            List<OfficerCohortAssignmentEntity> existing = assignmentRepository.findByUserId(req.getUserId())
                    .stream().filter(a -> a.getCohortId().equals(req.getCohortId())).toList();
            return existing.isEmpty()
                    ? ResponseEntity.ok(Map.of("status", "already_exists"))
                    : ResponseEntity.ok(toRow(existing.get(0)));
        }

        OfficerCohortAssignmentEntity entity = new OfficerCohortAssignmentEntity();
        entity.setUserId(req.getUserId());
        entity.setCohortId(req.getCohortId().trim());
        assignmentRepository.save(entity);

        log.info("Assignment created: Case Manager {} → cohort {}", req.getUserId(), req.getCohortId());
        return ResponseEntity.ok(toRow(entity));
    }

    // ── DELETE remove assignment ──────────────────────────────────────────────

    /**
     * DELETE /api/admin/assignments?userId=5&cohortId=COHORT-SC-001
     *
     * Removes a specific Case Manager ↔ cohort assignment.
     */
    @DeleteMapping
    @PreAuthorize("hasAnyRole('ADMIN')")
    @Transactional
    public ResponseEntity<Void> deleteAssignment(
            @RequestParam Long userId,
            @RequestParam String cohortId) {
        assignmentRepository.deleteByUserIdAndCohortId(userId, cohortId);
        log.info("Assignment removed: Case Manager {} → cohort {}", userId, cohortId);
        return ResponseEntity.noContent().build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> toRow(OfficerCohortAssignmentEntity a) {
        AppUserEntity user = userRepository.findById(a.getUserId()).orElse(null);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id",               a.getId());
        row.put("userId",            a.getUserId());
        row.put("caseManagerName",   user != null ? user.getName()  : "Unknown");
        row.put("caseManagerEmail",  user != null ? user.getEmail() : "unknown");
        row.put("cohortId",          a.getCohortId());
        row.put("assignedAt",        a.getAssignedAt() != null ? a.getAssignedAt().toString() : null);
        return row;
    }
}

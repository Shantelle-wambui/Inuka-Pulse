package com.inukapulse.program;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/programs")
public class ProgramController {

    private final ProgramService programService;

    public ProgramController(ProgramService programService) {
        this.programService = programService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'DATA_ANALYST', 'EXECUTIVE', 'ADMIN')")
    public ResponseEntity<List<ProgramDto>> getAllPrograms(
            @RequestParam(required = false) String pillar,
            @RequestParam(required = false) String county,
            @RequestParam(required = false) String status
    ) {
        List<ProgramDto> programs;
        
        if (pillar != null) {
            programs = programService.getProgramsByPillar(pillar);
        } else if (county != null) {
            programs = programService.getProgramsByCounty(county);
        } else if ("active".equalsIgnoreCase(status)) {
            programs = programService.getActivePrograms();
        } else {
            programs = programService.getAllPrograms();
        }
        
        return ResponseEntity.ok(programs);
    }

    @GetMapping("/{programId}")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'DATA_ANALYST', 'EXECUTIVE', 'ADMIN')")
    public ResponseEntity<ProgramDto> getProgram(@PathVariable String programId) {
        return programService.getProgramById(programId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/by-donor/{donorId}")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'DATA_ANALYST', 'EXECUTIVE', 'DONOR', 'ADMIN')")
    public ResponseEntity<List<ProgramDto>> getProgramsByDonor(@PathVariable String donorId) {
        return ResponseEntity.ok(programService.getProgramsByDonor(donorId));
    }

    @GetMapping("/counties")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<String>> getActiveCounties() {
        return ResponseEntity.ok(programService.getActiveCounties());
    }

    @GetMapping("/pillars")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<String>> getActivePillars() {
        return ResponseEntity.ok(programService.getActivePillars());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN')")
    public ResponseEntity<ProgramDto> createProgram(@Valid @RequestBody CreateProgramRequest request) {
        ProgramDto created = programService.createProgram(request);
        return ResponseEntity.status(201).body(created);
    }

    @PatchMapping("/{programId}/status")
    @PreAuthorize("hasAnyRole('PROGRAMME_DIRECTOR', 'ADMIN')")
    public ResponseEntity<ProgramDto> updateProgramStatus(
            @PathVariable String programId,
            @RequestParam String status
    ) {
        ProgramDto updated = programService.updateProgramStatus(programId, status);
        return ResponseEntity.ok(updated);
    }
}

package com.inukapulse.beneficiary;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OfficerCohortAssignmentRepository
        extends JpaRepository<OfficerCohortAssignmentEntity, Long> {

    /** All cohort IDs assigned to a given officer user. */
    @Query("SELECT o.cohortId FROM OfficerCohortAssignmentEntity o WHERE o.userId = :userId")
    List<String> findCohortIdsByUserId(@Param("userId") Long userId);

    /** All assignments for a given officer. */
    List<OfficerCohortAssignmentEntity> findByUserId(Long userId);

    /** All assignments for a given cohort. */
    List<OfficerCohortAssignmentEntity> findByCohortId(String cohortId);

    /** Check if an officer is assigned to a specific cohort. */
    boolean existsByUserIdAndCohortId(Long userId, String cohortId);

    /** Remove a specific assignment (used by admin delete). */
    void deleteByUserIdAndCohortId(Long userId, String cohortId);
}

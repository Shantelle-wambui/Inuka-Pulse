package com.inukapulse.beneficiary;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BeneficiaryFollowUpRepository extends JpaRepository<BeneficiaryFollowUpEntity, Long> {

    /** All follow-ups for a beneficiary, newest first. */
    List<BeneficiaryFollowUpEntity> findByBeneficiaryIdOrderByFollowUpDateDescCreatedAtDesc(
            String beneficiaryId);

    /** All follow-ups recorded by a specific officer, newest first. */
    List<BeneficiaryFollowUpEntity> findByOfficerIdOrderByFollowUpDateDescCreatedAtDesc(
            Long officerId);
}

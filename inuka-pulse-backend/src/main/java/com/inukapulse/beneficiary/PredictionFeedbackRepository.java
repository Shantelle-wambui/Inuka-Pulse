package com.inukapulse.beneficiary;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PredictionFeedbackRepository extends JpaRepository<PredictionFeedbackEntity, Long> {
    List<PredictionFeedbackEntity> findByBeneficiaryIdOrderByCreatedAtDesc(String beneficiaryId);
}

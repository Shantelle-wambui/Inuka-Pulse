package com.inukapulse.donor;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface DonorFundingRepository extends JpaRepository<DonorFundingEntity, String> {

    List<DonorFundingEntity> findByDonorId(String donorId);

    List<DonorFundingEntity> findByProgramId(String programId);

    List<DonorFundingEntity> findByFiscalYear(Integer fiscalYear);

    List<DonorFundingEntity> findByDonorIdAndFiscalYear(String donorId, Integer fiscalYear);

    List<DonorFundingEntity> findByFundingStatus(String status);

    @Query("SELECT SUM(df.amountKes) FROM DonorFundingEntity df WHERE df.donorId = :donorId")
    BigDecimal sumAmountByDonorId(@Param("donorId") String donorId);

    @Query("SELECT SUM(df.disbursedToDate) FROM DonorFundingEntity df WHERE df.donorId = :donorId")
    BigDecimal sumDisbursedByDonorId(@Param("donorId") String donorId);

    @Query("SELECT SUM(df.amountKes) FROM DonorFundingEntity df WHERE df.programId = :programId")
    BigDecimal sumAmountByProgramId(@Param("programId") String programId);

    @Query("SELECT SUM(df.disbursedToDate) FROM DonorFundingEntity df WHERE df.programId = :programId")
    BigDecimal sumDisbursedByProgramId(@Param("programId") String programId);

    @Query("SELECT SUM(df.amountKes) FROM DonorFundingEntity df WHERE df.fiscalYear = :year AND df.fundingStatus = 'active'")
    BigDecimal sumActiveAmountByYear(@Param("year") Integer year);

    @Query("SELECT COUNT(DISTINCT df.programId) FROM DonorFundingEntity df WHERE df.donorId = :donorId")
    long countProgramsByDonorId(@Param("donorId") String donorId);

    @Query("SELECT df FROM DonorFundingEntity df WHERE df.donorId = :donorId AND df.fundingStatus = 'active'")
    List<DonorFundingEntity> findActiveFundingByDonorId(@Param("donorId") String donorId);

    // ── Additional queries for metrics refresh ────────────────────────────────

    @Query("SELECT SUM(df.amountKes) FROM DonorFundingEntity df WHERE df.fundingStatus = 'active'")
    BigDecimal sumActiveFunding();

    @Query("SELECT SUM(df.disbursedToDate) FROM DonorFundingEntity df")
    BigDecimal sumDisbursed();

    @Query("SELECT SUM(df.amountKes) FROM DonorFundingEntity df " +
           "JOIN ProgramEntity p ON df.programId = CAST(p.programId AS string) " +
           "WHERE p.pillar = :pillar")
    BigDecimal sumFundingByPillar(@Param("pillar") String pillar);

    @Query("SELECT COUNT(DISTINCT df.programId) FROM DonorFundingEntity df WHERE df.donorId = :donorId")
    long countDistinctProgramsByDonor(@Param("donorId") String donorId);

    @Query("SELECT SUM(df.amountKes) FROM DonorFundingEntity df WHERE df.donorId = :donorId")
    BigDecimal sumFundingByDonor(@Param("donorId") String donorId);

    @Query("SELECT SUM(df.disbursedToDate) FROM DonorFundingEntity df WHERE df.donorId = :donorId")
    BigDecimal sumDisbursedByDonor(@Param("donorId") String donorId);
}

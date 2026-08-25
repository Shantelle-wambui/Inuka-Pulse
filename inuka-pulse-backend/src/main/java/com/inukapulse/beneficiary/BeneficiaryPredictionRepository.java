package com.inukapulse.beneficiary;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface BeneficiaryPredictionRepository extends JpaRepository<BeneficiaryPredictionEntity, Long> {

    /**
     * Latest prediction for every beneficiary — the "current state" view.
     * Fetches only the most recent as_of_date row per beneficiary_id.
     */
    @Query("""
            SELECT b FROM BeneficiaryPredictionEntity b
            WHERE b.asOfDate = (
                SELECT MAX(b2.asOfDate)
                FROM BeneficiaryPredictionEntity b2
                WHERE b2.beneficiaryId = b.beneficiaryId
            )
            ORDER BY b.dropoutProb DESC
            """)
    List<BeneficiaryPredictionEntity> findLatestPerBeneficiary();

    /**
     * Paginated latest predictions — used by the full beneficiary list endpoints.
     * Optional filters: band, county, pillar.
     */
    @Query("""
            SELECT b FROM BeneficiaryPredictionEntity b
            WHERE b.asOfDate = (
                SELECT MAX(b2.asOfDate)
                FROM BeneficiaryPredictionEntity b2
                WHERE b2.beneficiaryId = b.beneficiaryId
            )
            AND (:band   IS NULL OR b.predictedBand = :band)
            AND (:county IS NULL OR b.county        = :county)
            AND (:pillar IS NULL OR b.pillar         = :pillar)
            AND (:cohort IS NULL OR b.cohortId       = :cohort)
            ORDER BY b.dropoutProb DESC
            """)
    Page<BeneficiaryPredictionEntity> findLatestFiltered(
            @Param("band")   String band,
            @Param("county") String county,
            @Param("pillar") String pillar,
            @Param("cohort") String cohort,
            Pageable pageable
    );

    /** Latest prediction for a single beneficiary. */
    @Query("""
            SELECT b FROM BeneficiaryPredictionEntity b
            WHERE b.beneficiaryId = :beneficiaryId
            ORDER BY b.asOfDate DESC
            LIMIT 1
            """)
    Optional<BeneficiaryPredictionEntity> findLatestByBeneficiaryId(@Param("beneficiaryId") String beneficiaryId);

    /**
     * Count of each predicted_band across the latest snapshot.
     * Returns rows of [band, count] — used for summary / KPI cards.
     */
    @Query("""
            SELECT b.predictedBand, COUNT(b)
            FROM BeneficiaryPredictionEntity b
            WHERE b.asOfDate = (
                SELECT MAX(b2.asOfDate)
                FROM BeneficiaryPredictionEntity b2
                WHERE b2.beneficiaryId = b.beneficiaryId
            )
            GROUP BY b.predictedBand
            """)
    List<Object[]> countByBand();

    /**
     * Count by band for a specific county — used by Director county breakdown.
     */
    @Query("""
            SELECT b.predictedBand, COUNT(b)
            FROM BeneficiaryPredictionEntity b
            WHERE b.asOfDate = (
                SELECT MAX(b2.asOfDate)
                FROM BeneficiaryPredictionEntity b2
                WHERE b2.beneficiaryId = b.beneficiaryId
            )
            AND b.county = :county
            GROUP BY b.predictedBand
            """)
    List<Object[]> countByBandForCounty(@Param("county") String county);

    /**
     * Count by band for a specific pillar — used by Director pillar breakdown.
     */
    @Query("""
            SELECT b.predictedBand, COUNT(b)
            FROM BeneficiaryPredictionEntity b
            WHERE b.asOfDate = (
                SELECT MAX(b2.asOfDate)
                FROM BeneficiaryPredictionEntity b2
                WHERE b2.beneficiaryId = b.beneficiaryId
            )
            AND b.pillar = :pillar
            GROUP BY b.predictedBand
            """)
    List<Object[]> countByBandForPillar(@Param("pillar") String pillar);

    /**
     * Latest predictions scoped to a specific cohort — used by Case Manager
     * to see only their assigned cohort's beneficiaries.
     */
    @Query("""
            SELECT b FROM BeneficiaryPredictionEntity b
            WHERE b.asOfDate = (
                SELECT MAX(b2.asOfDate)
                FROM BeneficiaryPredictionEntity b2
                WHERE b2.beneficiaryId = b.beneficiaryId
            )
            AND b.cohortId = :cohortId
            ORDER BY b.dropoutProb DESC
            """)
    List<BeneficiaryPredictionEntity> findLatestByCohort(@Param("cohortId") String cohortId);

    /** Check if a prediction already exists for a given beneficiary + date (idempotent ETL). */
    boolean existsByBeneficiaryIdAndAsOfDate(String beneficiaryId, LocalDate asOfDate);

    /** Distinct counties in the latest predictions — for filter dropdowns. */
    @Query("SELECT DISTINCT b.county FROM BeneficiaryPredictionEntity b WHERE b.county IS NOT NULL ORDER BY b.county")
    List<String> findDistinctCounties();

    /** Distinct pillars — for filter dropdowns. */
    @Query("SELECT DISTINCT b.pillar FROM BeneficiaryPredictionEntity b WHERE b.pillar IS NOT NULL ORDER BY b.pillar")
    List<String> findDistinctPillars();

    /** Most recent as_of_date across all records — tells you when the last prediction run was. */
    @Query("SELECT MAX(b.asOfDate) FROM BeneficiaryPredictionEntity b")
    Optional<LocalDate> findLatestAsOfDate();

    /**
     * Risk trend: band counts grouped by as_of_date, ordered ascending by date.
     * Returns rows of [as_of_date, predicted_band, count].
     * Used by the Director risk trend line chart to show how each risk band
     * has changed across prediction pipeline snapshots over time.
     */
    @Query("""
            SELECT b.asOfDate, b.predictedBand, COUNT(b)
            FROM BeneficiaryPredictionEntity b
            GROUP BY b.asOfDate, b.predictedBand
            ORDER BY b.asOfDate ASC
            """)
    List<Object[]> countByBandPerDate();

    /** All distinct prediction snapshot dates, ascending. */
    @Query("SELECT DISTINCT b.asOfDate FROM BeneficiaryPredictionEntity b ORDER BY b.asOfDate ASC")
    List<LocalDate> findDistinctDates();

    /**
     * Total distinct beneficiaries in the entire table (all snapshots combined).
     * Used as the total-enrolled count when no completion data is available.
     */
    @Query("SELECT COUNT(DISTINCT b.beneficiaryId) FROM BeneficiaryPredictionEntity b")
    long countDistinctBeneficiaries();

    /**
     * Count distinct beneficiaries by pillar across the latest snapshot.
     * Returns rows of [pillar, count].
     */
    @Query("""
            SELECT b.pillar, COUNT(DISTINCT b.beneficiaryId)
            FROM BeneficiaryPredictionEntity b
            WHERE b.asOfDate = (
                SELECT MAX(b2.asOfDate) FROM BeneficiaryPredictionEntity b2
            )
            AND b.pillar IS NOT NULL
            GROUP BY b.pillar
            """)
    List<Object[]> countDistinctBeneficiariesByPillar();

    /**
     * Count distinct beneficiaries by county across the latest snapshot.
     * Returns rows of [county, count].
     */
    @Query("""
            SELECT b.county, COUNT(DISTINCT b.beneficiaryId)
            FROM BeneficiaryPredictionEntity b
            WHERE b.asOfDate = (
                SELECT MAX(b2.asOfDate) FROM BeneficiaryPredictionEntity b2
            )
            AND b.county IS NOT NULL
            GROUP BY b.county
            """)
    List<Object[]> countDistinctBeneficiariesByCounty();

    /**
     * Band counts per snapshot date for a specific pillar.
     * Returns rows of [asOfDate, predictedBand, count].
     * Used for trend charts scoped to a pillar.
     */
    @Query("""
            SELECT b.asOfDate, b.predictedBand, COUNT(b)
            FROM BeneficiaryPredictionEntity b
            WHERE b.pillar = :pillar
            GROUP BY b.asOfDate, b.predictedBand
            ORDER BY b.asOfDate ASC
            """)
    List<Object[]> countByBandPerDateForPillar(@Param("pillar") String pillar);

    /**
     * Total dropout count across the latest snapshot (predicted_band = 'Dropout').
     * Used for dropout-rate computation.
     */
    @Query("""
            SELECT COUNT(b)
            FROM BeneficiaryPredictionEntity b
            WHERE b.asOfDate = (
                SELECT MAX(b2.asOfDate) FROM BeneficiaryPredictionEntity b2
            )
            AND b.predictedBand = 'Dropout'
            """)
    long countDropoutsLatestSnapshot();

    // ── Performance-optimized aggregate queries ──────────────────────────────
    // These replace N+1 query patterns with single aggregate queries.

    /**
     * Band counts grouped by county — single query for all counties.
     * Returns rows of [county, predicted_band, count].
     * Replaces the N+1 pattern of calling countByBandForCounty() per county.
     */
    @Query("""
            SELECT b.county, b.predictedBand, COUNT(b)
            FROM BeneficiaryPredictionEntity b
            WHERE b.asOfDate = (
                SELECT MAX(b2.asOfDate)
                FROM BeneficiaryPredictionEntity b2
                WHERE b2.beneficiaryId = b.beneficiaryId
            )
            AND b.county IS NOT NULL
            GROUP BY b.county, b.predictedBand
            ORDER BY b.county, b.predictedBand
            """)
    List<Object[]> countByBandGroupedByCounty();

    /**
     * Band counts grouped by pillar — single query for all pillars.
     * Returns rows of [pillar, predicted_band, count].
     * Replaces the N+1 pattern of calling countByBandForPillar() per pillar.
     */
    @Query("""
            SELECT b.pillar, b.predictedBand, COUNT(b)
            FROM BeneficiaryPredictionEntity b
            WHERE b.asOfDate = (
                SELECT MAX(b2.asOfDate)
                FROM BeneficiaryPredictionEntity b2
                WHERE b2.beneficiaryId = b.beneficiaryId
            )
            AND b.pillar IS NOT NULL
            GROUP BY b.pillar, b.predictedBand
            ORDER BY b.pillar, b.predictedBand
            """)
    List<Object[]> countByBandGroupedByPillar();
}

package com.inukapulse.site;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SiteRepository extends JpaRepository<SiteEntity, String> {

    @Query("SELECT COUNT(s) FROM SiteEntity s WHERE s.programId = :programId")
    long countByProgramId(@Param("programId") String programId);

    @Query("SELECT s FROM SiteEntity s WHERE s.programId = :programId")
    List<SiteEntity> findByProgramId(@Param("programId") String programId);

    @Query("SELECT s FROM SiteEntity s WHERE s.programId IS NOT NULL")
    List<SiteEntity> findAllWithProgram();

    @Query("SELECT DISTINCT s.programId FROM SiteEntity s WHERE s.programId IS NOT NULL")
    List<String> findDistinctProgramIds();

    // ── Additional queries for metrics refresh ────────────────────────────────

    // Note: SiteEntity maps to dim_site, not cohorts.
    // Risk/status queries are on alert and prediction entities, not here.
}

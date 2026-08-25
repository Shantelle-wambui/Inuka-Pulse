package com.inukapulse.program;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProgramRepository extends JpaRepository<ProgramEntity, String> {

    List<ProgramEntity> findByPillar(String pillar);

    List<ProgramEntity> findByCounty(String county);

    List<ProgramEntity> findByStatus(String status);

    List<ProgramEntity> findByPillarAndCounty(String pillar, String county);

    @Query("SELECT p FROM ProgramEntity p WHERE p.status = 'active'")
    List<ProgramEntity> findActivePrograms();

    @Query("SELECT DISTINCT p.county FROM ProgramEntity p WHERE p.status = 'active'")
    List<String> findActiveCounties();

    @Query("SELECT DISTINCT p.pillar FROM ProgramEntity p WHERE p.status = 'active'")
    List<String> findActivePillars();

    @Query("SELECT p FROM ProgramEntity p WHERE p.programId IN " +
           "(SELECT df.programId FROM DonorFundingEntity df WHERE df.donorId = :donorId)")
    List<ProgramEntity> findProgramsByDonorId(@Param("donorId") String donorId);

    // ── Additional queries for metrics refresh ────────────────────────────────

    @Query("SELECT SUM(p.targetCapacity) FROM ProgramEntity p WHERE p.pillar = :pillar AND p.status = 'active'")
    Integer sumCapacityByPillar(@Param("pillar") String pillar);

    @Query("SELECT SUM(p.targetCapacity) FROM ProgramEntity p WHERE p.county = :county AND p.status = 'active'")
    Integer sumCapacityByCounty(@Param("county") String county);

    @Query("SELECT COUNT(p) FROM ProgramEntity p WHERE p.county = :county AND p.status = 'active'")
    long countByCounty(@Param("county") String county);
}

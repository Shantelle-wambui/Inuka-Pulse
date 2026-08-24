package com.inukapulse.allocation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ResourceAllocationRepository extends JpaRepository<ResourceAllocationEntity, String> {

    List<ResourceAllocationEntity> findByProgramId(String programId);

    List<ResourceAllocationEntity> findByRegion(String region);

    List<ResourceAllocationEntity> findByResourceType(String resourceType);

    List<ResourceAllocationEntity> findByStatus(String status);

    List<ResourceAllocationEntity> findBySource(String source);

    @Query("SELECT r FROM ResourceAllocationEntity r WHERE r.status = 'pending' ORDER BY r.priorityScore DESC")
    List<ResourceAllocationEntity> findPendingRecommendations();

    @Query("SELECT r FROM ResourceAllocationEntity r WHERE r.source = 'ml_recommended' AND r.status = 'pending' ORDER BY r.priorityScore DESC")
    List<ResourceAllocationEntity> findMlRecommendations();

    @Query("SELECT r FROM ResourceAllocationEntity r WHERE r.periodStart <= :date AND r.periodEnd >= :date AND r.status = 'active'")
    List<ResourceAllocationEntity> findActiveAllocations(@Param("date") LocalDate date);

    @Query("SELECT r FROM ResourceAllocationEntity r WHERE r.programId = :programId AND r.status IN ('pending', 'active')")
    List<ResourceAllocationEntity> findActiveAndPendingByProgram(@Param("programId") String programId);

    @Query("SELECT SUM(r.allocatedAmount) FROM ResourceAllocationEntity r WHERE r.programId = :programId AND r.resourceType = :type AND r.status = 'active'")
    java.math.BigDecimal sumActiveAllocationByProgramAndType(
            @Param("programId") String programId,
            @Param("type") String type
    );
}

package com.inukapulse.analytics;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DashboardMetricsRepository extends JpaRepository<DashboardMetricsEntity, DashboardMetricsId> {

    List<DashboardMetricsEntity> findByScopeTypeAndScopeId(String scopeType, String scopeId);

    List<DashboardMetricsEntity> findByScopeType(String scopeType);

    List<DashboardMetricsEntity> findByMetricKey(String metricKey);

    @Query("SELECT m FROM DashboardMetricsEntity m WHERE m.scopeType = :scopeType AND m.scopeId = :scopeId AND m.period = :period")
    List<DashboardMetricsEntity> findByScopeAndPeriod(
            @Param("scopeType") String scopeType,
            @Param("scopeId") String scopeId,
            @Param("period") String period
    );

    @Query("SELECT m FROM DashboardMetricsEntity m WHERE m.metricKey = :metricKey AND m.scopeType = :scopeType AND m.scopeId = :scopeId AND m.period = :period")
    Optional<DashboardMetricsEntity> findMetric(
            @Param("metricKey") String metricKey,
            @Param("scopeType") String scopeType,
            @Param("scopeId") String scopeId,
            @Param("period") String period
    );

    @Query("SELECT MAX(m.updatedAt) FROM DashboardMetricsEntity m")
    Optional<LocalDateTime> findLastUpdated();

    @Query("SELECT m FROM DashboardMetricsEntity m WHERE m.scopeType = 'org' AND m.scopeId = 'inuka' AND m.period = :period")
    List<DashboardMetricsEntity> findOrgMetrics(@Param("period") String period);

    @Query("SELECT m FROM DashboardMetricsEntity m WHERE m.scopeType = 'pillar' AND m.period = :period")
    List<DashboardMetricsEntity> findPillarMetrics(@Param("period") String period);

    @Query("SELECT m FROM DashboardMetricsEntity m WHERE m.scopeType = 'county' AND m.period = :period")
    List<DashboardMetricsEntity> findCountyMetrics(@Param("period") String period);

    @Query("SELECT m FROM DashboardMetricsEntity m WHERE m.scopeType = 'donor' AND m.scopeId = :donorId")
    List<DashboardMetricsEntity> findDonorMetrics(@Param("donorId") String donorId);
}

package com.inukapulse.analytics;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "dashboard_metrics")
@IdClass(DashboardMetricsId.class)
public class DashboardMetricsEntity {

    @Id
    @Column(name = "metric_key", length = 100)
    private String metricKey;

    @Id
    @Column(name = "scope_type", length = 50)
    private String scopeType;

    @Id
    @Column(name = "scope_id", length = 100)
    private String scopeId;

    @Id
    @Column(name = "period", length = 20)
    private String period;

    @Column(name = "metric_value", precision = 15, scale = 4, nullable = false)
    private BigDecimal value;

    @Column(name = "previous_value", precision = 15, scale = 4)
    private BigDecimal previousValue;

    @Column(name = "change_pct", precision = 7, scale = 4)
    private BigDecimal changePct;

    @Column(name = "trend_direction", length = 10)
    private String trendDirection;

    @Column(name = "is_available")
    private Boolean isAvailable = true;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public DashboardMetricsEntity() {
    }

    public DashboardMetricsEntity(String metricKey, String scopeType, String scopeId, String period, BigDecimal value) {
        this.metricKey = metricKey;
        this.scopeType = scopeType;
        this.scopeId = scopeId;
        this.period = period;
        this.value = value;
        this.updatedAt = LocalDateTime.now();
    }

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        computeTrend();
    }

    private void computeTrend() {
        if (previousValue != null && previousValue.compareTo(BigDecimal.ZERO) != 0) {
            changePct = value.subtract(previousValue)
                    .divide(previousValue, 4, java.math.RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));
            
            int comparison = changePct.compareTo(BigDecimal.ZERO);
            if (comparison > 0) {
                trendDirection = "up";
            } else if (comparison < 0) {
                trendDirection = "down";
            } else {
                trendDirection = "stable";
            }
        }
    }

    // Getters and Setters
    public String getMetricKey() {
        return metricKey;
    }

    public void setMetricKey(String metricKey) {
        this.metricKey = metricKey;
    }

    public String getScopeType() {
        return scopeType;
    }

    public void setScopeType(String scopeType) {
        this.scopeType = scopeType;
    }

    public String getScopeId() {
        return scopeId;
    }

    public void setScopeId(String scopeId) {
        this.scopeId = scopeId;
    }

    public String getPeriod() {
        return period;
    }

    public void setPeriod(String period) {
        this.period = period;
    }

    public BigDecimal getValue() {
        return value;
    }

    public void setValue(BigDecimal value) {
        this.value = value;
    }

    public BigDecimal getPreviousValue() {
        return previousValue;
    }

    public void setPreviousValue(BigDecimal previousValue) {
        this.previousValue = previousValue;
    }

    public BigDecimal getChangePct() {
        return changePct;
    }

    public String getTrendDirection() {
        return trendDirection;
    }

    public Boolean getIsAvailable() {
        return isAvailable;
    }

    public void setIsAvailable(Boolean isAvailable) {
        this.isAvailable = isAvailable;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}

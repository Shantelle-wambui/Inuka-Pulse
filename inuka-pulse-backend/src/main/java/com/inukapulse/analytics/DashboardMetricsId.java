package com.inukapulse.analytics;

import java.io.Serializable;
import java.util.Objects;

public class DashboardMetricsId implements Serializable {
    
    private String metricKey;
    private String scopeType;
    private String scopeId;
    private String period;

    public DashboardMetricsId() {
    }

    public DashboardMetricsId(String metricKey, String scopeType, String scopeId, String period) {
        this.metricKey = metricKey;
        this.scopeType = scopeType;
        this.scopeId = scopeId;
        this.period = period;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        DashboardMetricsId that = (DashboardMetricsId) o;
        return Objects.equals(metricKey, that.metricKey) &&
               Objects.equals(scopeType, that.scopeType) &&
               Objects.equals(scopeId, that.scopeId) &&
               Objects.equals(period, that.period);
    }

    @Override
    public int hashCode() {
        return Objects.hash(metricKey, scopeType, scopeId, period);
    }

    // Getters and setters
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
}

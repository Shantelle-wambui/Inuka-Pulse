"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ChartErrorBoundaryProps {
  children: ReactNode;
  /** Name of the chart for error message context */
  chartName?: string;
  /** Optional fallback height to maintain layout when chart fails */
  fallbackHeight?: string;
  /** Optional callback when error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically designed for chart components.
 * 
 * Catches render errors in chart libraries (Recharts, etc.) and displays
 * a user-friendly fallback instead of crashing the entire dashboard.
 * 
 * Usage:
 *   <ChartErrorBoundary chartName="Risk Trend">
 *     <RiskTrendChart data={riskTrend} />
 *   </ChartErrorBoundary>
 * 
 * This prevents a single malformed data point from taking down the entire
 * dashboard — the affected chart shows an error state while other charts
 * continue to function.
 */
export class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChartErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to console for debugging
    console.error(
      `ChartErrorBoundary caught error in ${this.props.chartName ?? "chart"}:`,
      error,
      errorInfo
    );
    
    // Call optional error handler (e.g., for error reporting service)
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ChartUnavailable
          chartName={this.props.chartName}
          error={this.state.error}
          height={this.props.fallbackHeight}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Fallback UI displayed when a chart fails to render.
 * Can be used standalone or as the fallback for ChartErrorBoundary.
 */
interface ChartUnavailableProps {
  chartName?: string;
  error?: Error | null;
  height?: string;
  onRetry?: () => void;
}

export function ChartUnavailable({
  chartName = "Chart",
  error,
  height = "200px",
  onRetry,
}: ChartUnavailableProps) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted/10"
      style={{ minHeight: height }}
    >
      <Alert variant="default" className="m-4 max-w-sm border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-800 dark:text-amber-300">
          {chartName} Unavailable
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          <p className="mb-2">
            This chart couldn&apos;t be displayed. The data may be temporarily unavailable
            or in an unexpected format.
          </p>
          {error && process.env.NODE_ENV === "development" && (
            <p className="mb-2 font-mono text-xs opacity-75">
              {error.message}
            </p>
          )}
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2 border-amber-500/50 text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
            >
              <RefreshCw className="mr-1.5 size-3" />
              Try Again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}

/**
 * HOC version for wrapping chart components inline.
 * 
 * Usage:
 *   const SafeRiskTrendChart = withChartErrorBoundary(RiskTrendChart, "Risk Trend");
 */
export function withChartErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  chartName: string
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ChartErrorBoundary chartName={chartName}>
      <WrappedComponent {...props} />
    </ChartErrorBoundary>
  );
  
  WithErrorBoundary.displayName = `withChartErrorBoundary(${WrappedComponent.displayName ?? WrappedComponent.name ?? "Component"})`;
  
  return WithErrorBoundary;
}

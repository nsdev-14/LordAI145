/**
 * LORD Monitoring Service
 * Tracks application health, performance, errors, and user activity.
 */

export type HealthStatus = "healthy" | "warning" | "critical";

export interface SystemMetrics {
  uptime: number;
  latency: number;
  errorCount: number;
  warningCount: number;
  apiStatus: "online" | "degraded" | "offline";
  dbStatus: "online" | "degraded" | "offline";
  authStatus: "online" | "offline";
  healthScore: number;
}

export interface AppEvent {
  id: string;
  timestamp: number;
  type: "error" | "warning" | "info" | "action" | "navigation" | "api";
  category: string;
  message: string;
  metadata?: unknown;
}

class MonitoringService {
  private startTime: number = Date.now();
  private events: AppEvent[] = [];
  private metrics: SystemMetrics = {
    uptime: 0,
    latency: 0,
    errorCount: 0,
    warningCount: 0,
    apiStatus: "online",
    dbStatus: "online",
    authStatus: "online",
    healthScore: 100,
  };

  private listeners: Set<(metrics: SystemMetrics, events: AppEvent[]) => void> = new Set();

  private lastSuccessAt: number | null = null;
  private failedRequests = 0;
  private rateLimited = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.setupGlobalListeners();
      this.startUptimeTracker();
    }
  }

  public getStartTime(): number {
    return this.startTime;
  }

  public getLastSuccessAt(): number | null {
    return this.lastSuccessAt;
  }

  public getFailedRequests(): number {
    return this.failedRequests;
  }

  public isRateLimited(): boolean {
    return this.rateLimited;
  }

  public markSuccess() {
    this.lastSuccessAt = Date.now();
    this.notify();
  }

  public markFailure(rateLimited = false) {
    this.failedRequests++;
    if (rateLimited) this.rateLimited = true;
    this.notify();
  }

  private setupGlobalListeners() {
    window.addEventListener("error", (event) => {
      this.logEvent({
        type: "error",
        category: "runtime",
        message: event.message,
        metadata: { filename: event.filename, lineno: event.lineno },
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.logEvent({
        type: "error",
        category: "promise",
        message: "Unhandled Promise Rejection",
        metadata: { reason: event.reason },
      });
    });
  }

  private startUptimeTracker() {
    setInterval(() => {
      this.metrics.uptime = Math.floor((Date.now() - this.startTime) / 1000);
      this.notify();
    }, 1000);
  }

  public logEvent(event: Omit<AppEvent, "id" | "timestamp">) {
    const newEvent: AppEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    this.events.push(newEvent);
    if (this.events.length > 100) this.events.shift();

    if (event.type === "error") {
      this.metrics.errorCount++;
      this.updateHealthScore();
    } else if (event.type === "warning") {
      this.metrics.warningCount++;
      this.updateHealthScore();
    }

    this.notify();
    return newEvent;
  }

  public updateLatency(ms: number) {
    this.metrics.latency = ms;
    this.notify();
  }

  public updateStatus(type: "api" | "db" | "auth", status: "online" | "degraded" | "offline") {
    if (type === "api") this.metrics.apiStatus = status;
    if (type === "db") this.metrics.dbStatus = status;
    if (type === "auth") this.metrics.authStatus = status === "degraded" ? "offline" : status;
    this.updateHealthScore();
    this.notify();
  }

  private updateHealthScore() {
    let score = 100;
    score -= this.metrics.errorCount * 5;
    score -= this.metrics.warningCount * 2;
    if (this.metrics.apiStatus !== "online") score -= 20;
    if (this.metrics.dbStatus !== "online") score -= 20;
    if (this.metrics.authStatus !== "online") score -= 10;
    this.metrics.healthScore = Math.max(0, score);
  }

  public getHealthStatus(): HealthStatus {
    if (this.metrics.healthScore > 80) return "healthy";
    if (this.metrics.healthScore > 50) return "warning";
    return "critical";
  }

  public getMetrics() {
    return { ...this.metrics };
  }

  public getRecentEvents(limit = 10) {
    return [...this.events].reverse().slice(0, limit);
  }

  public subscribe(listener: (metrics: SystemMetrics, events: AppEvent[]) => void) {
    this.listeners.add(listener);
    listener({ ...this.metrics }, [...this.events]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l({ ...this.metrics }, [...this.events]));
  }
}

export const monitoring = new MonitoringService();

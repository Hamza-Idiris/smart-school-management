import { EventEmitter } from 'events';

class DashboardBus extends EventEmitter {
  notify(schoolId, payload = {}) {
    this.emit('kpi', { schoolId: schoolId.toString(), ...payload, at: new Date().toISOString() });
  }
}

export const dashboardBus = new DashboardBus();

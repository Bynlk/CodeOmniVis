import { EventEmitter } from 'events'

export const codeomnivisEvents = new EventEmitter()

export const EVENTS: Readonly<{
  GRAPH_UPDATED: 'graph:updated'
  ANALYSIS_STARTED: 'analysis:started'
  ANALYSIS_COMPLETED: 'analysis:completed'
  STATUS_CHANGED: 'status:changed'
}> = {
  GRAPH_UPDATED: 'graph:updated',
  ANALYSIS_STARTED: 'analysis:started',
  ANALYSIS_COMPLETED: 'analysis:completed',
  STATUS_CHANGED: 'status:changed',
}

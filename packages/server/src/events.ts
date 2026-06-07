import { EventEmitter } from 'events'

export const codeomnivisEvents = new EventEmitter()

export const EVENTS = {
  GRAPH_UPDATED: 'graph:updated',
  ANALYSIS_STARTED: 'analysis:started',
  ANALYSIS_COMPLETED: 'analysis:completed',
} as const

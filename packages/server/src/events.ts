import { EventEmitter } from 'events'

export const codeomnivisEvents = new EventEmitter()

export const EVENTS: Readonly<{
  GRAPH_UPDATED: 'graph:updated'
  ANALYSIS_STARTED: 'analysis:started'
  ANALYSIS_COMPLETED: 'analysis:completed'
}> = {
  GRAPH_UPDATED: 'graph:updated',
  ANALYSIS_STARTED: 'analysis:started',
  ANALYSIS_COMPLETED: 'analysis:completed',
}

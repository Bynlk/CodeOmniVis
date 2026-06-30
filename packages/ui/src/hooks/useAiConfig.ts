/**
 * useAiConfig — 订阅全局 AI 配置 store 的单一数据源 Hook。
 *
 * 通过 useSyncExternalStore 订阅 lib/aiConfig 的外部 store,任一处
 * 保存/清除都会让所有消费组件(SettingsDrawer / AiPanel)同步刷新,
 * 消除评审 M3 指出的重复且会漂移的本地 config 状态。
 */

import { useSyncExternalStore } from 'react'
import {
  subscribeAiConfig,
  getAiConfigState,
  type AiConfigState,
} from '../lib/aiConfig'

export function useAiConfig(): AiConfigState {
  return useSyncExternalStore(subscribeAiConfig, getAiConfigState, getAiConfigState)
}

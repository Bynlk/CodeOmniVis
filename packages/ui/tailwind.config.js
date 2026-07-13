/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // feature-010 布局层级:z-index 语义 token,消灭全站散落魔法值。
      // 关键约束:tooltip(45) 严格低于 modal(50),模态打开时 tooltip 不会盖在其上。
      zIndex: {
        'base': '0',
        'canvas-ui': '10', // Legend、画布内浮标
        'panel': '20',     // 右轨面板(桌面栅格内一般无需 z)
        'drawer': '40',    // 移动端抽屉 + 遮罩
        'tooltip': '45',   // NodeTooltip —— 高于 drawer 但【低于 modal】
        'modal': '50',     // CommandPalette / SettingsDrawer
      },
      colors: {
        // feature-011 表面语义色 —— 映射到 index.css 的 :root CSS 变量,
        // 供全站以 class 引用统一的背景/边框/文本层级(深色主题)。
        surface: {
          DEFAULT: 'var(--surface-base)',
          panel: 'var(--surface-panel)',
          raised: 'var(--surface-raised)',
          overlay: 'var(--surface-overlay)',
          hover: 'var(--surface-hover)',
        },
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        content: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        // CodeOmniVis 品牌色
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#a6bcff',
          400: '#78a1ff',
          500: '#5b8cff',
          600: '#4776e6',
          700: '#365fc2',
          800: '#2f4f9d',
          900: '#2b447d',
          950: '#1b294d',
        },
        // 节点类型语义色 —— 单一真源与 packages/shared NODE_COLORS 对齐。
        // Cytoscape 画布与图例(Legend)均从 NODE_COLORS 取色,tailwind token 仅镜像同值,
        // 保证任何以 class 形式引用的配色与画布渲染 100% 一致(feature-003 AC1/AC2)。
        node: {
          page: '#6366f1',
          component: '#3b82f6',
          'api-route': '#10b981',
          'trpc-procedure': '#06b6d4',
          'tsrpc-service': '#14b8a6',
          'tsrpc-api': '#0d9488',
          'tsrpc-msg': '#2dd4bf',
          'express-route': '#f59e0b',
          handler: '#f59e0b',
          service: '#8b5cf6',
          'db-model': '#ec4899',
          module: '#374151',
          'kotlin-class': '#a855f7',
          'kotlin-interface': '#3b82f6',
          'kotlin-object': '#f97316',
          'kotlin-function': '#22c55e',
          'kotlin-route': '#eab308',
        },
      },
      // 统一间距 scale(4px 基线),供全站复用
      spacing: {
        'ds-1': '0.25rem',
        'ds-2': '0.5rem',
        'ds-3': '0.75rem',
        'ds-4': '1rem',
        'ds-5': '1.5rem',
        'ds-6': '2rem',
      },
      // 统一圆角 scale
      borderRadius: {
        'ds-sm': '0.25rem',
        'ds-md': '0.5rem',
        'ds-lg': '0.75rem',
        'ds-xl': '1rem',
      },
      // 统一字号 scale
      fontSize: {
        'ds-xs': ['0.75rem', { lineHeight: '1rem' }],
        'ds-sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'ds-base': ['1rem', { lineHeight: '1.5rem' }],
        'ds-lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'ds-xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      // 统一阴影 scale(深色背景友好)
      boxShadow: {
        'ds-panel': '0 8px 24px rgba(0, 0, 0, 0.34)',
        'ds-card': '0 1px 3px rgba(0, 0, 0, 0.28)',
      },
      animation: {
        slideDown: 'slideDown 0.2s ease-out',
        fadeIn: 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

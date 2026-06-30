import { useState } from 'react'

// 导出的箭头函数组件 —— 必须被识别为导出组件
export const ArrowCard = () => {
  const [open, setOpen] = useState(false)
  return <div onClick={() => setOpen(!open)}>{open ? 'open' : 'closed'}</div>
}

// 未导出的箭头函数组件 —— 不应计入导出组件
const InternalWidget = () => <span>internal</span>

// 非组件的导出常量(首字母小写)—— 不应被误判为组件
export const helperValue = () => 42

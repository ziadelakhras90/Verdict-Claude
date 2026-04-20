import React from 'react'

interface Props   { children: React.ReactNode }
interface State   { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message }
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', err, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="text-6xl">⚠️</div>
          <h1 className="font-display text-2xl text-gold">حدث خطأ غير متوقع</h1>
          <p className="text-ink-400 text-sm font-mono bg-ink-800 rounded-xl p-3 text-right break-words">
            {this.state.message}
          </p>
          <button
            className="btn-primary mx-auto"
            onClick={() => window.location.href = '/'}
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    )
  }
}

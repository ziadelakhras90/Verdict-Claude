import { cn } from '@/lib/utils'

// Generic shimmer skeleton block
function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg bg-ink-800 relative overflow-hidden',
        'after:absolute after:inset-0',
        'after:bg-gradient-to-r after:from-transparent after:via-ink-700/60 after:to-transparent',
        'after:animate-shimmer after:bg-[length:200%_100%]',
        className
      )}
    />
  )
}

// Lobby skeleton
export function LobbySkeleton() {
  return (
    <div className="max-w-md mx-auto space-y-5 p-4 py-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Bone className="h-7 w-32" />
          <Bone className="h-3.5 w-20" />
        </div>
        <Bone className="h-5 w-16 rounded-full" />
      </div>

      <div className="card-glass rounded-2xl p-6 text-center space-y-3">
        <Bone className="h-3.5 w-24 mx-auto" />
        <Bone className="h-14 w-48 mx-auto rounded-xl" />
        <div className="flex gap-2 justify-center">
          <Bone className="h-8 w-24 rounded-lg" />
          <Bone className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[1,2,3].map(i => <Bone key={i} className="h-16 rounded-xl" />)}
      </div>

      <div className="card-glass rounded-2xl p-4 space-y-2">
        <Bone className="h-3.5 w-20" />
        {[1,2,3].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-ink-700/30">
            <Bone className="w-9 h-9 rounded-full flex-shrink-0" />
            <Bone className="h-4 flex-1" />
            <Bone className="h-6 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Card skeleton
export function RoleCardSkeleton() {
  return (
    <div className="max-w-md mx-auto space-y-5 p-4 py-8">
      <div className="text-center space-y-2">
        <Bone className="h-7 w-32 mx-auto" />
        <Bone className="h-3.5 w-48 mx-auto" />
      </div>
      <div className="card-glass rounded-2xl p-5 space-y-3">
        <Bone className="h-3.5 w-20" />
        <Bone className="h-7 w-48" />
        <Bone className="h-16 w-full" />
        <div className="flex gap-2">
          <Bone className="h-5 w-20 rounded-full" />
          <Bone className="h-5 w-12 rounded-full" />
        </div>
      </div>
      <div className="rounded-2xl border-2 border-ink-700 p-6 space-y-4">
        <div className="text-center space-y-2">
          <Bone className="h-14 w-14 rounded-full mx-auto" />
          <Bone className="h-8 w-32 mx-auto" />
        </div>
        <Bone className="h-px w-full" />
        <Bone className="h-24 w-full rounded-xl" />
      </div>
    </div>
  )
}

// Session skeleton
export function SessionSkeleton() {
  return (
    <div className="h-screen flex flex-col max-w-2xl mx-auto">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gold/10">
        <Bone className="h-6 w-24 rounded-full" />
        <div className="flex-1" />
        <Bone className="h-12 w-28 rounded-xl" />
      </div>
      <div className="flex-1 p-4 space-y-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="flex gap-3">
            <Bone className="w-8 h-8 rounded-full flex-shrink-0" />
            <Bone className="h-16 flex-1 rounded-xl" />
          </div>
        ))}
      </div>
      <div className="border-t border-gold/10 p-4 space-y-3">
        <div className="flex gap-2">
          {[1,2,3].map(i => <Bone key={i} className="flex-1 h-9 rounded-lg" />)}
        </div>
        <Bone className="h-16 w-full rounded-xl" />
        <Bone className="h-11 w-full rounded-xl" />
      </div>
    </div>
  )
}

'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-serif text-[30px] font-bold text-primary-800">Something went wrong</h1>
      <p className="mt-2 text-primary-900">We could not load this page right now. Please try again in a moment.</p>
      <button onClick={reset} className="mt-6 rounded-lg bg-primary-800 px-6 py-2.5 font-serif font-bold text-white">Try again</button>
    </div>
  );
}

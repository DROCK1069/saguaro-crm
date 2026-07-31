import { redirect } from 'next/navigation';

/**
 * /app/bids/score — the standalone scorer here was a demo: it fabricated a local
 * heuristic score + breakdown when the API failed (fake setTimeout "AI thinking",
 * hardcoded fallback score, breakdown bars the real API never returns) and its
 * "Add to Pipeline" button reported success even when the create call failed.
 *
 * The real, honest bid scorer is the "Score a Bid" modal on the Bid Center, which
 * calls /api/bids/score (real AI scoring, surfaces failures, persists the scored
 * opportunity to bid history). Send everyone there instead of maintaining a
 * fabricated duplicate.
 */
export default function BidScoreRedirect() {
  redirect('/app/bids?tab=score');
}

/**
 * StuckNudge
 *
 * Renders nothing. Watches the session trail and, after two distinct empty searches or two API
 * errors on the current page within two minutes, offers to open the AI assistant with the
 * question pre-filled (handed over via router state). One nudge per page per ten minutes.
 */

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { notify } from '@/lib/notify';
import { getTrail, nudgeQuestion, shouldNudge, subscribe } from '@/lib/session-trail';

const COOLDOWN_MS = 10 * 60 * 1000;

export default function StuckNudge() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const nudgedAt = useRef(new Map<string, number>());

  useEffect(() => {
    return subscribe(() => {
      const page = pathRef.current;
      if (page.startsWith('/ai-assistant')) return;

      const now = Date.now();
      if (now - (nudgedAt.current.get(page) ?? 0) < COOLDOWN_MS) return;

      const reason = shouldNudge(getTrail(), page, now);
      if (!reason) return;
      nudgedAt.current.set(page, now);

      const ask = nudgeQuestion(reason, page);
      notify.message('Stuck? Ask the assistant', {
        description:
          reason.kind === 'search'
            ? 'It can see what you searched for and will tell you where to look.'
            : 'It can see the error you just got and what usually fixes it.',
        duration: 12000,
        action: { label: 'Ask', onClick: () => navigate('/ai-assistant', { state: { ask } }) },
      });
    });
  }, [navigate]);

  return null;
}

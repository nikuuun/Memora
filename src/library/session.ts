import { router } from 'expo-router';

import { applyChanges } from '../db/actions';
import { STATUS } from '../db/db';
import { rowsWhere, type Filter } from '../db/queries';
import { items } from '../theme';
import { useLibrary } from './store';

/**
 * Opening a group takes a snapshot of its items, so the screen works on
 * exactly what you saw even if the library changes meanwhile.
 */
export async function openGrid(filter: Filter, title: string) {
  const rows = await rowsWhere(filter);
  useLibrary.getState().setSession({ title, mode: filter.scope, rows });
  router.push('/grid');
}

export async function openDeck(filter: Filter, title: string) {
  const rows = await rowsWhere(filter);
  useLibrary.getState().setSession({ title, mode: filter.scope, rows });
  router.push('/deck');
}

/** Reviewed → To review, with undo. */
export async function reviewAgain(filter: Filter) {
  const rows = await rowsWhere(filter);
  const undo = await applyChanges(rows.map((r) => ({ id: r.id, prev: r.status, next: STATUS.todo })));
  useLibrary.getState().showToast(`${items(rows.length)} moved back to To review.`, undo);
}

import {
  type AdminLeadsResponse,
  type AdminMedia,
  type AdminResourceMeta,
  type AdminSignupsResponse,
  type AdminSlotsResponse,
} from '@charva/contracts';
import { queryOptions } from '@tanstack/react-query';

import { adminApi } from './client';

/**
 * Every request the admin makes, in one file — the same convention the three public sites use.
 *
 * Rows are `Record<string, unknown>` on purpose. Their shape is decided by the table they came
 * from and described by `/admin/resources` at runtime, which is exactly what lets one list
 * screen and one form screen serve twenty entities instead of twenty pairs of components.
 */

export type Row = Record<string, unknown>;

export interface RowsPage {
  items: Row[];
  meta: { page: number; perPage: number; total: number; totalPages: number; hasMore: boolean };
}

/** Nothing here is cached for long: an editor who saves wants to see what they saved. */
const FRESH = 5_000;

export function resourcesQuery() {
  return queryOptions({
    queryKey: ['resources'] as const,
    queryFn: ({ signal }) =>
      adminApi.get<{ resources: AdminResourceMeta[] }>('/admin/resources', undefined, signal),
    // The field descriptions change when a migration ships, which is to say never during a
    // session. Everything else on screen is derived from them, so this is worth holding.
    staleTime: Infinity,
  });
}

export type ListParams = Record<string, string | number | undefined>;

export function rowsQuery(resource: string, params: ListParams) {
  return queryOptions({
    queryKey: ['rows', resource, params] as const,
    queryFn: ({ signal }) => adminApi.get<RowsPage>(`/admin/${resource}`, params, signal),
    staleTime: FRESH,
  });
}

export function rowQuery(resource: string, id: number) {
  return queryOptions({
    queryKey: ['row', resource, id] as const,
    queryFn: ({ signal }) =>
      adminApi.get<Row>(`/admin/${resource}/${String(id)}`, undefined, signal),
    staleTime: FRESH,
  });
}

export function mediaQuery(params: ListParams) {
  return queryOptions({
    queryKey: ['media', params] as const,
    queryFn: ({ signal }) =>
      adminApi.get<{ items: AdminMedia[]; meta: RowsPage['meta'] }>('/admin/media', params, signal),
    staleTime: FRESH,
  });
}

export function slotsQuery(params: ListParams) {
  return queryOptions({
    queryKey: ['slots', params] as const,
    queryFn: ({ signal }) =>
      adminApi.get<AdminSlotsResponse>('/admin/content_slots', params, signal),
    staleTime: FRESH,
  });
}

export function leadsQuery(params: ListParams) {
  return queryOptions({
    queryKey: ['leads', params] as const,
    queryFn: ({ signal }) => adminApi.get<AdminLeadsResponse>('/admin/leads', params, signal),
    staleTime: FRESH,
  });
}

export function signupsQuery(params: ListParams) {
  return queryOptions({
    queryKey: ['signups', params] as const,
    queryFn: ({ signal }) =>
      adminApi.get<AdminSignupsResponse>('/admin/umrah_signups', params, signal),
    staleTime: FRESH,
  });
}

// --------------------------------------------------------------------------------------------
// Writes
// --------------------------------------------------------------------------------------------

export function createRow(resource: string, body: Row): Promise<Row> {
  return adminApi.post<Row>(`/admin/${resource}`, body);
}

export function updateRow(resource: string, id: number, body: Row): Promise<Row> {
  return adminApi.patch<Row>(`/admin/${resource}/${String(id)}`, body);
}

export function deleteRow(resource: string, id: number): Promise<{ ok: true }> {
  return adminApi.remove<{ ok: true }>(`/admin/${resource}/${String(id)}`);
}

export function reorderRows(
  resource: string,
  items: { id: number; sortOrder: number }[],
): Promise<{ ok: true }> {
  return adminApi.post<{ ok: true }>(`/admin/${resource}/reorder`, { items });
}

export function uploadMedia(file: File) {
  return adminApi.upload<{ media: AdminMedia; poster: AdminMedia | null; isDuplicate: boolean }>(
    '/admin/media',
    file,
  );
}

export function patchMedia(id: number, body: Record<string, unknown>): Promise<AdminMedia> {
  return adminApi.patch<AdminMedia>(`/admin/media/${String(id)}`, body);
}

export function attachSlot(slotId: number, mediaId: number | null): Promise<{ ok: true }> {
  return adminApi.put<{ ok: true }>(`/admin/content_slots/${String(slotId)}/media`, { mediaId });
}

export function patchLead(id: number, body: Record<string, unknown>) {
  return adminApi.patch<Row>(`/admin/leads/${String(id)}`, body);
}

export function patchSignup(id: number, body: Record<string, unknown>) {
  return adminApi.patch<Row>(`/admin/umrah_signups/${String(id)}`, body);
}

/**
 * The one request in this file that writes a row to `audit_log` before it answers.
 *
 * A reason is required by the schema, not by politeness: a log of «somebody read this» with no
 * «because» answers nothing on the day it is finally read.
 */
export function revealPassport(signupId: number, reason: string) {
  return adminApi.post<{ passportNumber: string; recordedAt: string }>(
    `/admin/umrah_signups/${String(signupId)}/passport`,
    { reason },
  );
}

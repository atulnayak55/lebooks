import { api } from "../../lib/api";
import type { Listing } from "../../types/domain";

export type ListingCreatePayload = {
  title: string;
  price: number;
  condition: string;
  description?: string;
  subject_id: number;
};

export async function fetchListings(subjectId?: number): Promise<Listing[]> {
  const response = await api.get<Listing[]>("/listings", {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return response.data;
}

export async function createListing(
  payload: ListingCreatePayload,
  token: string,
): Promise<Listing> {
  const response = await api.post<Listing>("/listings/", payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}

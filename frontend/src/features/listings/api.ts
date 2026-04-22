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

export async function uploadListingImage(
  listingId: number,
  file: File,
  token: string,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  await api.post(`/listings/${listingId}/images`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
}

export async function uploadListingImages(
  listingId: number,
  files: File[],
  token: string,
): Promise<void> {
  for (const file of files) {
    await uploadListingImage(listingId, file, token);
  }
}

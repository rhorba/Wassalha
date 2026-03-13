type EmailAddress = { email_address: string; id: string };

type UserEventData = {
  email_addresses: EmailAddress[];
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
};

export function getPrimaryEmail(data: UserEventData): string {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );
  return primary?.email_address ?? data.email_addresses[0]?.email_address ?? "";
}

export function getFullName(data: UserEventData): string | null {
  const parts = [data.first_name, data.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

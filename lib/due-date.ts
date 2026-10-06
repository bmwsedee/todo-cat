const dueDateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  // A due date has no time; read it as midnight UTC and show it in UTC, so no time zone moves it.
  timeZone: "UTC",
});

/** A `yyyy-mm-dd` due date for people, like "Wed 7 Oct"; the same on server and browser. */
export function formatDueDate(dueDate: string) {
  return dueDateFormat.format(new Date(`${dueDate}T00:00:00Z`));
}

/** Today as a `yyyy-mm-dd` due date, in UTC; the date Lissie and the list both read due dates against. */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

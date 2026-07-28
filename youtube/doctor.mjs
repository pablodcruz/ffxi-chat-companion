export async function inspectYouTubeReadPath({
  youtube,
  configuredLiveChatId = null,
}) {
  const liveChatId =
    configuredLiveChatId || await youtube.findActiveLiveChatId();
  const page = await youtube.listMessages({ liveChatId });
  return Object.freeze({
    ok: true,
    active_chat_found: true,
    chat_is_live: !page.offlineAt,
    text_messages_observed: page.messages.length,
    polling_interval_ms: page.pollingIntervalMillis,
    continuation_available: Boolean(page.nextPageToken),
  });
}

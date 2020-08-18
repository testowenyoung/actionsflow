import { Rss, TelegramBot, Webhook, Poll } from "./triggers";
import { createContentDigest, getCache } from "./helpers";
import log from "./log";
import {
  TriggerName,
  ITriggerContext,
  ITriggerResult,
  IItem,
} from "./interfaces";
const MAX_CACHE_KEYS_COUNT = 1000;
type TriggerMapType = Record<
  TriggerName,
  typeof Rss | typeof TelegramBot | typeof Webhook | typeof Poll
>;

const triggerNameMap: TriggerMapType = {
  rss: Rss,
  poll: Poll,
  webhook: Webhook,
  telegram_bot: TelegramBot,
};
interface ITriggerOptions {
  trigger: {
    name: TriggerName;
    options: Record<string, unknown>;
    workflowRelativePath: string;
  };
  context: ITriggerContext;
}

export const run = async ({
  trigger,
  context,
}: ITriggerOptions): Promise<ITriggerResult> => {
  log.debug("trigger:", trigger);
  // get unique id
  let triggerId = "";
  if (trigger && trigger.options && trigger.options.id) {
    triggerId = trigger.options.id as string;
  } else {
    triggerId = createContentDigest({
      name: trigger.name,
      path: trigger.workflowRelativePath,
    });
  }
  const finalResult: ITriggerResult = {
    id: triggerId,
    items: [],
  };
  if (triggerNameMap[trigger.name]) {
    const triggerHelpers = {
      createContentDigest,
      cache: getCache(`trigger-${triggerId}`),
    };
    const triggerOptions = {
      helpers: triggerHelpers,
      options: trigger.options,
      context: context,
    };
    const Trigger = triggerNameMap[trigger.name];
    const triggerInstance = new Trigger();

    const triggerResult = await triggerInstance.run(triggerOptions);
    const { shouldDeduplicate, getItemKey, updateInterval } = triggerResult;
    let { items } = triggerResult;
    const maxItemsCount = trigger.options.max_items_count as number;
    const skipFirst = trigger.options.skip_first || false;

    if (!items || items.length === 0) {
      return finalResult;
    }
    // updateInterval
    const lastUpdatedAt =
      (await triggerHelpers.cache.get("lastUpdatedAt")) || 0;
    log.debug("lastUpdatedAt: ", lastUpdatedAt);

    if (updateInterval) {
      // check if should update
      // unit minutes
      // get latest update time
      const shouldUpdateUtil =
        (lastUpdatedAt as number) + updateInterval * 60 * 1000;
      const now = Date.now();
      const shouldUpdate = shouldUpdateUtil - now <= 0;
      log.debug("shouldUpdate:", shouldUpdate);
      // write to cache
      await triggerHelpers.cache.set("lastUpdatedAt", now);
      if (!shouldUpdate) {
        return finalResult;
      }
    }
    // duplicate
    if (shouldDeduplicate === true) {
      // duplicate
      const getItemKeyFn =
        getItemKey ||
        ((item: IItem): string => {
          if (item.guid) return item.guid as string;
          if (item.id) return item.id as string;
          return createContentDigest(item);
        });

      // deduplicate
      // get cache
      let deduplicationKeys =
        (await triggerHelpers.cache.get("deduplicationKeys")) || [];
      log.debug("get cached deduplicationKeys", deduplicationKeys);
      const itemsKeyMaps = new Map();
      items.forEach((item) => {
        itemsKeyMaps.set(getItemKeyFn(item), item);
      });
      items = [...itemsKeyMaps.values()];

      items = items.filter((result) => {
        const key = getItemKeyFn(result);
        if ((deduplicationKeys as string[]).includes(key)) {
          return false;
        } else {
          return true;
        }
      });

      if (maxItemsCount) {
        items = items.slice(0, maxItemsCount);
      }
      // if save to cache
      if (items.length > 0) {
        deduplicationKeys = (deduplicationKeys as string[]).concat(
          items.map((item: IItem) => getItemKeyFn(item))
        );
        deduplicationKeys = (deduplicationKeys as string[]).slice(
          -MAX_CACHE_KEYS_COUNT
        );
        log.debug("set deduplicationKeys", deduplicationKeys);

        // set cache
        await triggerHelpers.cache.set("deduplicationKeys", deduplicationKeys);
      } else {
        log.debug("no items update, do not need to update cache");
      }
    }

    if (skipFirst && lastUpdatedAt === 0) {
      return finalResult;
    }
    finalResult.items = items;
  } else {
    log.warn(`we don't support this trigger [${trigger.name}] yet`);
  }
  return finalResult;
};

import type ruMessages from "./messages/ru.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof ruMessages;
  }
}

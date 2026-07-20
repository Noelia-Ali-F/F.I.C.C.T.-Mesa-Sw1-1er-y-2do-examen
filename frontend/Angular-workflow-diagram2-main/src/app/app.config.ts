import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";

import { routes } from "./app.routes";
import { BASE_PATH } from "./api/variables";
import { authInterceptor } from "./auth/auth.interceptor";
import { provideServiceWorker } from "@angular/service-worker";
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideMessaging, getMessaging } from '@angular/fire/messaging';
import { firebaseConfig } from "./notifications/firebase.config";


export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: BASE_PATH,
      useValue:
        (window as any).__env?.apiUrl !== undefined
          ? (window as any).__env.apiUrl
          : window.location.hostname === "localhost"
            ? "http://localhost:8080"
            : "https://workflow-service-930110874838.us-central1.run.app",
    },
    provideServiceWorker("ngsw-worker.js", {
      enabled: !isDevMode(),
      registrationStrategy: "registerWhenStable:30000",
    }),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideMessaging(() => getMessaging()),
  ],
};

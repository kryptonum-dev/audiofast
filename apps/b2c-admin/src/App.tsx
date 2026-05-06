import { useEffect, useMemo, useState } from "react";
import {
  SanityApp,
  type SanityConfig,
  useAuthToken,
  useCurrentUser,
} from "@sanity/sdk-react";

import "./App.css";
import { sanityAppConfig } from "./config.js";

type AdminBridgeState =
  | {
      status: "idle" | "loading";
      message: string;
    }
  | {
      status: "connected";
      message: string;
      operator: {
        name: string;
        email: string;
        projectRole: string | null;
      };
      mode: string;
    }
  | {
      status: "blocked" | "error";
      message: string;
    };

const sanityConfig: SanityConfig[] = [
  {
    projectId: sanityAppConfig.projectId,
    dataset: sanityAppConfig.dataset,
  },
];

function AdminBridgeDiagnostic() {
  const authToken = useAuthToken();
  const currentUser = useCurrentUser();
  const [bridgeState, setBridgeState] = useState<AdminBridgeState>({
    status: "idle",
    message: "Waiting for Sanity Dashboard session.",
  });

  const currentUserLabel = useMemo(() => {
    if (!currentUser) return "Waiting for Sanity user";

    return `${currentUser.name} (${currentUser.email})`;
  }, [currentUser]);

  useEffect(() => {
    if (!authToken) {
      setBridgeState({
        status: "idle",
        message: "Waiting for Sanity auth token.",
      });
      return;
    }

    const controller = new AbortController();

    async function verifyBridge() {
      setBridgeState({
        status: "loading",
        message: "Checking Audiofast backend bridge.",
      });

      try {
        const response = await fetch(
          `${sanityAppConfig.adminApiBaseUrl}/api/admin/b2c/me/`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
            signal: controller.signal,
          },
        );
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          setBridgeState({
            status: response.status === 403 ? "blocked" : "error",
            message:
              typeof payload.message === "string"
                ? payload.message
                : "The backend bridge rejected the current Sanity session.",
          });
          return;
        }

        setBridgeState({
          status: "connected",
          message: "Sanity session verified by Audiofast backend.",
          operator: {
            name: payload.operator.name,
            email: payload.operator.email,
            projectRole: payload.operator.projectRole,
          },
          mode: payload.access.mode,
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        setBridgeState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not reach the Audiofast backend bridge.",
        });
      }
    }

    void verifyBridge();

    return () => {
      controller.abort();
    };
  }, [authToken]);

  return (
    <main className="adminShell">
      <section className="diagnosticPanel" aria-labelledby="admin-title">
        <p className="eyebrow">Phase 08 Step 2</p>
        <h1 id="admin-title">Audiofast B2C Admin</h1>
        <dl className="statusList">
          <div>
            <dt>Sanity user</dt>
            <dd>{currentUserLabel}</dd>
          </div>
          <div>
            <dt>Backend bridge</dt>
            <dd data-status={bridgeState.status}>{bridgeState.message}</dd>
          </div>
          {bridgeState.status === "connected" ? (
            <>
              <div>
                <dt>Verified operator</dt>
                <dd>
                  {bridgeState.operator.name} ({bridgeState.operator.email})
                </dd>
              </div>
              <div>
                <dt>Access mode</dt>
                <dd>{bridgeState.mode}</dd>
              </div>
              <div>
                <dt>Project role</dt>
                <dd>{bridgeState.operator.projectRole ?? "Unknown"}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <SanityApp config={sanityConfig} fallback={<div>Loading...</div>}>
      <AdminBridgeDiagnostic />
    </SanityApp>
  );
}

import { Component, type ErrorInfo, type ReactNode } from "react";
import { PageError } from "./PageState";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[App] Display error", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return <PageError fullScreen title="La page n’a pas pu s’afficher" message="Une erreur est survenue. Vous pouvez recharger la page ou revenir à l’accueil." onRetry={() => window.location.reload()} onBack={() => window.location.assign("/")} />;
    }
    return this.props.children;
  }
}
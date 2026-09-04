declare module "swagger-ui-react" {
  import type { ComponentType } from "react";

  interface SwaggerUIProps {
    spec?: object;
    url?: string;
    urls?: Array<{ url: string; name: string }>;
    docExpansion?: "list" | "full" | "none";
    defaultModelsExpandDepth?: number;
    defaultModelExpandDepth?: number;
    tryItOutEnabled?: boolean;
    showRequestHeaders?: boolean;
    filter?: boolean | string;
    queryConfigEnabled?: boolean;
    displayOperationId?: boolean;
    displayRequestDuration?: boolean;
    deepLinking?: boolean;
    showExtensions?: boolean;
    showCommonExtensions?: boolean;
    layout?: string;
    plugins?: unknown[];
    presets?: unknown[];
    onComplete?: (system: unknown) => void;
    requestInterceptor?: (req: unknown) => unknown;
    responseInterceptor?: (res: unknown) => unknown;
    [key: string]: unknown;
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}

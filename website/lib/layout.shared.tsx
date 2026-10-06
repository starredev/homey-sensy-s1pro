import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, basePath, githubUrl } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2 font-semibold">
          <img src={`${basePath}/logo.png`} alt="" width={24} height={24} className="rounded-md" />
          {appName}
        </span>
      ),
    },
    githubUrl,
  };
}

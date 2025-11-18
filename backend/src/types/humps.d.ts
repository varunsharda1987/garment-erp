declare module 'humps' {
  export function camelize(str: string): string;
  export function decamelize(str: string, options?: { separator?: string }): string;
  export function camelizeKeys<T = any>(
    obj: any,
    processor?: (key: string, convert: (key: string) => string) => string
  ): T;
  export function decamelizeKeys<T = any>(
    obj: any,
    options?: { separator?: string; process?: (key: string, convert: (key: string) => string) => string }
  ): T;
  export function pascalize(str: string): string;
  export function pascalizeKeys<T = any>(obj: any): T;
  export function depascalize(str: string, options?: { separator?: string }): string;
  export function depascalizeKeys<T = any>(obj: any, options?: { separator?: string }): T;
}

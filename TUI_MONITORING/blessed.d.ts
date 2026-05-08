declare module 'blessed' {
  export interface WidgetOptions {
    [key: string]: any;
  }
  
  // Screen and Box classes (constructors)
  class Screen {
    constructor(options?: WidgetOptions);
    key(keys: string[], handler: () => void): void;
    render(): void;
  }
  
  class Box {
    constructor(options?: WidgetOptions);
    setContent(content: string): void;
  }
  
  // blessed is callable and also has properties
  interface BlessedFunction {
    (): Screen;
    Screen: typeof Screen;
    screen: typeof Screen;
    box: typeof Box;
  }
  
  const blessed: BlessedFunction;
  export default blessed;
}

declare module 'blessed-contrib' {
  export class Grid {
    constructor(options: { rows: number; cols: number; screen: any });
    set(row: number, col: number, rowSpan: number, colSpan: number, Widget: any, options: any): any;
  }
  
  export class Sparkline {
    constructor(options: any);
    setData(labels: string[], data: number[][]): void;
  }
  
  const contrib: {
    grid: typeof Grid;
    sparkline: typeof Sparkline;
  };
  export default contrib;
}
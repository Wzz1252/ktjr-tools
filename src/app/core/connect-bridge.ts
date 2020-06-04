export default class ConnectBridge {
  private static bridge: ConnectBridge = new ConnectBridge();

  private constructor() {
  }

  public static getInstance(): ConnectBridge {
    return this.bridge;
  }

  public run(argv: string): void {
    console.log("argv: ", argv);
  }
}

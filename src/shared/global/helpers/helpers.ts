export class Helpers {
  static firstLetterUppercase(str: string): string {
    const valueString = str.toLowerCase();
    return valueString
      .split(' ')
      .map(
        (value: string) =>
          `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}`,
      )
      .join(' ');
  }

  static lowerCase(value: string): string {
    return value.toLowerCase();
  }

  static generateRandomIntegers(length: number): number {
    const characters = '0123456789';
    let result = '';
    const charactersLength = characters.length;

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charactersLength);
      result += characters.charAt(randomIndex);
    }
    return parseInt(result, 10);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static parseJson(prop: string): any {
    try {
      return JSON.parse(prop);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return prop;
    }
  }
}

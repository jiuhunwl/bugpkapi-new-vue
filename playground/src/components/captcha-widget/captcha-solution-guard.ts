export function createCaptchaSolutionGuard() {
  let activeCaptchaId = '';
  let emitted = false;
  let generation = 0;

  return {
    accept(expectedGeneration: number, currentCaptchaId: string) {
      if (
        emitted ||
        expectedGeneration !== generation ||
        currentCaptchaId !== activeCaptchaId
      ) {
        return false;
      }
      emitted = true;
      return true;
    },
    begin(captchaId: string) {
      activeCaptchaId = captchaId;
      emitted = false;
      generation += 1;
      return generation;
    },
    current() {
      return generation;
    },
    invalidate() {
      activeCaptchaId = '';
      emitted = true;
      generation += 1;
    },
    retry() {
      emitted = false;
    },
  };
}

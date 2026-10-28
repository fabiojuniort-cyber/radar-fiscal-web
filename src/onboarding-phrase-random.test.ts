import {expect,it} from 'vitest'
import {nextOnboardingPhrase} from './onboarding-phrase-random'
it('excludes the last display across calls and samples the remaining pool',()=>{
  expect(nextOnboardingPhrase(['A','B','C'],()=>0)).toBe('A')
  expect(nextOnboardingPhrase(['A','B','C'],()=>0)).toBe('B')
  expect(nextOnboardingPhrase(['A','B','C'],()=>0.99)).toBe('C')
  expect(nextOnboardingPhrase(['C','D'],()=>0)).toBe('D')
})

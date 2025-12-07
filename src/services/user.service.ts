import { CognitoUser } from '../types';

export interface UserProfile {
  username: string;
  email: string;
  role: string;
  sub: string;
}

export const getUserProfile = (cognitoUser: CognitoUser): UserProfile => {
  return {
    username: cognitoUser['cognito:username'] || cognitoUser.username,
    email: cognitoUser.email,
    role: cognitoUser['custom:role'] || 'Field Engineer',
    sub: cognitoUser.sub,
  };
};

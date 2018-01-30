// @flow

import React from 'react';
import styled from 'styled-components';

type SwitcherButtonProps = {
  appName: string,
  appPath: string,
}

const Button = styled.button`
  padding: 20px;
  border-radius: 15px;
  border: 2px solid #888;
  background-color: PaleGreen;
  font-weight: bold;
  width: 20em;
`;

export default function SwitcherButton({ appName, appPath }: SwitcherButtonProps) {
  return (
    <Button onClick={() => window.history.pushState({}, appName, appPath)}>
      Go to {appName}.
    </Button>
  );
}

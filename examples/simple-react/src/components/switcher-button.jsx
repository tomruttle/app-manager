// @flow

import React, { PureComponent } from 'react';
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

export default class SwitcherButton extends PureComponent<SwitcherButtonProps> {
  handleClick = () => {
    window.history.pushState({}, this.props.appName, this.props.appPath);
  };

  render = () => (
    <Button onClick={this.handleClick}>
      Go to {this.props.appName}.
    </Button>
  );
}

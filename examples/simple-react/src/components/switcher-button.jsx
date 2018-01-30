// @flow

import React, { PureComponent } from 'react';
import styled from 'styled-components';

type SwitcherButtonProps = {
  appName: string,
  appPath: string,
}

const Button = styled.button`
  border: 0;
  padding: 1em;
  box-shadow: 1px 1px #ddd;
  font-weight: bold;
  font-size: 0.8em;
`;

const RightAlignDiv = styled.div`
  text-align: right;
`;

export default class SwitcherButton extends PureComponent<SwitcherButtonProps> {
  handleClick = () => {
    window.history.pushState({}, this.props.appName, this.props.appPath);
  };

  render = () => (
    <RightAlignDiv>
      <Button onClick={this.handleClick}>Go to {this.props.appName}</Button>
    </RightAlignDiv>
  );
}

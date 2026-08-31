import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

/** Catches render-tree crashes so Android does not hard-exit on a single UI failure. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message ? String(error.message) : 'Something went wrong',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[ErrorBoundary]', error, info?.componentStack);
  }

  private retry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>WaiAir</Text>
        <Text style={styles.body}>The app hit an unexpected error.</Text>
        {this.state.message ? (
          <Text style={styles.detail} numberOfLines={4}>{this.state.message}</Text>
        ) : null}
        <Pressable style={styles.btn} onPress={this.retry} accessibilityRole="button">
          <Text style={styles.btnTxt}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f1117',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    color: '#FFD700',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: '#F8FAFC',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  detail: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  btn: {
    marginTop: 8,
    backgroundColor: '#FFD700',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnTxt: {
    color: '#0D1B2E',
    fontWeight: '700',
    fontSize: 15,
  },
});

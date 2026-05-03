from backend.core.state import BlackboardState

class BaseAgent:
    """所有智能体统一基类，封装通用能力"""
    def __init__(self):
        self.blackboard = BlackboardState()

    def read_blackboard(self):
        return self.blackboard

    def write_blackboard(self, state):
        self.blackboard = state